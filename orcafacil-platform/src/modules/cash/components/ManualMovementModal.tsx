import { useState, useRef } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Info,
  Paperclip,
  Trash2,
  X,
  Eye,
} from 'lucide-react';
import { formatCurrency } from '@shared/utils/monetary';

interface ManualMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    type: 'supply' | 'bleed';
    amount: number;
    reason: string;
    category?: string;
    attachmentFile?: File | null;
    moveToAccount?: boolean;
  }) => Promise<void>;
  currentSessionId: string;
  organizationId?: string;
  isLoading?: boolean;
}

const BLEED_CATEGORIES = [
  'Pagamento de Compra / Fornecedor',
  'Sangria de Segurança / Cofre',
  'Despesa Operacional / Manutenção',
  'Adiantamento / Vale',
  'Outra Saída',
];

const SUPPLY_CATEGORIES = [
  'Reforço de Fundo de Troco',
  'Aporte de Câmbio / Troco',
  'Outra Entrada',
];

export function ManualMovementModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: ManualMovementModalProps) {
  const [type, setType] = useState<'supply' | 'bleed'>('bleed');
  const [amountStr, setAmountStr] = useState<string>('');
  const [category, setCategory] = useState<string>('Pagamento de Compra / Fornecedor');
  const [moveToAccount, setMoveToAccount] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const parsedAmount =
    parseFloat(amountStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;

  const handleTypeChange = (newType: 'supply' | 'bleed') => {
    setType(newType);
    setMoveToAccount(false);
    if (newType === 'bleed') {
      setCategory('Pagamento de Compra / Fornecedor');
    } else {
      setCategory('Reforço de Fundo de Troco');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachmentFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setAttachmentPreviewUrl(url);
    } else {
      setAttachmentPreviewUrl(null);
    }
  };

  const handleRemoveAttachment = () => {
    if (attachmentPreviewUrl) {
      URL.revokeObjectURL(attachmentPreviewUrl);
    }
    setAttachmentFile(null);
    setAttachmentPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0 || !reason.trim()) return;

    await onConfirm({
      type,
      amount: parsedAmount,
      reason: reason.trim(),
      category: category || (type === 'supply' ? 'Suprimento' : 'Sangria'),
      attachmentFile,
      moveToAccount:
        type === 'bleed' &&
        (category === 'Sangria de Segurança / Cofre' || category.includes('Segurança')) &&
        moveToAccount,
    });

    handleRemoveAttachment();
    setAmountStr('');
    setReason('');
    setMoveToAccount(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 my-8">
          {/* Cabeçalho */}
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
                  {type === 'bleed' ? 'Registrar Sangria (Saída)' : 'Registrar Suprimento (Entrada)'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {type === 'bleed'
                    ? 'Retirada de dinheiro da gaveta do caixa'
                    : 'Entrada de troco ou reposição na gaveta do caixa'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Seletor Tipo: Suprimento vs Sangria */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('bleed')}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${
                  type === 'bleed'
                    ? 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 ring-2 ring-rose-500/20'
                    : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300'
                }`}
              >
                <ArrowUpRight className="h-4 w-4 text-rose-600" />
                Sangria (Saída)
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('supply')}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${
                  type === 'supply'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300'
                }`}
              >
                <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                Suprimento (Entrada)
              </button>
            </div>

            {/* Painel Explicativo da Movimentação */}
            <div
              className={`rounded-xl border p-3.5 text-xs ${
                type === 'bleed'
                  ? 'border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200'
                  : 'border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Info
                  className={`h-4 w-4 shrink-0 mt-0.5 ${
                    type === 'bleed' ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                />
                <div className="space-y-1">
                  <p className="font-bold text-xs uppercase tracking-wide">
                    {type === 'bleed'
                      ? 'O que é Sangria / Saída de Caixa?'
                      : 'O que é Suprimento / Entrada de Caixa?'}
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    {type === 'bleed'
                      ? 'É a retirada de dinheiro físico da gaveta do caixa. Utilizada para pagar compras a fornecedores, despesas operacionais emergenciais, fretes, adiantamentos ou recolhimento de segurança para o cofre.'
                      : 'É o acréscimo de dinheiro físico na gaveta do caixa. Utilizado para reforço de fundo de troco, troca de cédulas por moedas ou aportes de expediente.'}
                  </p>
                  <p className="font-semibold text-[11px] pt-0.5">
                    Impacto:{' '}
                    {type === 'bleed'
                      ? 'Reduz o saldo em dinheiro (gaveta) do caixa imediatamente.'
                      : 'Aumenta o saldo em dinheiro (gaveta) do caixa imediatamente.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Categoria / Tipo de Despesa */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Classificação da Movimentação
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white dark:bg-zinc-800 p-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:border-blue-500 focus:outline-none dark:border-zinc-700"
              >
                {(type === 'bleed' ? BLEED_CATEGORIES : SUPPLY_CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Flag Mover para a conta? quando for Sangria de Segurança */}
            {type === 'bleed' && (category === 'Sangria de Segurança / Cofre' || category.includes('Segurança')) && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moveToAccount}
                    onChange={(e) => setMoveToAccount(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      Mover para a conta?
                    </span>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                      Caso marcada, o valor retirado da gaveta física será transferido e somado ao <strong>Saldo em Conta</strong> da empresa.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Valor da Operação */}
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
                  className="w-full rounded-xl border border-zinc-300 py-2.5 pl-9 pr-3 text-sm font-bold text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Justificativa Obrigatória */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Justificativa / Descrição <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-zinc-400">Obrigatória</span>
              </div>
              <textarea
                required
                rows={2}
                placeholder={
                  type === 'bleed'
                    ? 'Ex: Compra de materiais de limpeza com nota / Pagamento do freteiro João...'
                    : 'Ex: Reforço de troco em moedas e notas de R$ 2 e R$ 5...'
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 p-3 text-xs focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            {/* Campo Anexo de Nota de Compra / Comprovante (Opcional) */}
            <div className="rounded-xl border border-dashed border-zinc-300 p-3.5 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <Paperclip className="h-3.5 w-3.5 text-blue-600" />
                  Nota de Compra / Comprovante (Opcional)
                </label>
                <span className="text-[10px] text-zinc-400">PDF ou Imagem (até 10MB)</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="movement-receipt-attachment"
              />

              {!attachmentFile ? (
                <label
                  htmlFor="movement-receipt-attachment"
                  className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white p-3 text-center cursor-pointer hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700/60 transition"
                >
                  <Paperclip className="h-5 w-5 text-zinc-400" />
                  <span className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
                    Clique aqui para anexar a nota ou foto do comprovante
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    JPG, PNG ou PDF da nota fiscal ou recibo de compra
                  </span>
                </label>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {attachmentFile.type.startsWith('image/') ? (
                      attachmentPreviewUrl ? (
                        <img
                          src={attachmentPreviewUrl}
                          alt="Prévia"
                          className="h-10 w-10 rounded-md object-cover border border-zinc-200 dark:border-zinc-700"
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-blue-500" />
                      )
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-rose-50 text-rose-600 dark:bg-rose-950/60">
                        <FileText className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {attachmentFile.name}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {(attachmentFile.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {attachmentPreviewUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewModalOpen(true)}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-700"
                        title="Visualizar imagem"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/60"
                      title="Remover anexo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex justify-end gap-3 border-t pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading || parsedAmount <= 0 || !reason.trim()}
                className={`rounded-xl px-5 py-2 text-xs font-bold text-white transition disabled:opacity-50 shadow-md ${
                  type === 'supply'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20'
                }`}
              >
                {isLoading
                  ? 'Registrando...'
                  : type === 'supply'
                  ? `Lançar Suprimento (+${formatCurrency(parsedAmount)})`
                  : `Lançar Sangria (-${formatCurrency(parsedAmount)})`}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Pré-visualização do Anexo */}
      {previewModalOpen && attachmentPreviewUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
          <div className="relative max-h-[90vh] max-w-2xl rounded-2xl bg-white p-3 shadow-2xl dark:bg-zinc-900 border border-zinc-800 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewModalOpen(false)}
              className="absolute top-2 right-2 rounded-full bg-zinc-800/80 p-1.5 text-white hover:bg-zinc-700"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={attachmentPreviewUrl}
              alt="Comprovante"
              className="max-h-[80vh] rounded-lg object-contain"
            />
            <p className="mt-2 text-xs text-zinc-500">{attachmentFile?.name}</p>
          </div>
        </div>
      )}
    </>
  );
}
