import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Download,
  HardDrive,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { licenseService, type LicenseStatus } from '../license.service'

interface OfflineActivationModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  onSuccess?: () => void
}

export const OfflineActivationModal: React.FC<OfflineActivationModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [concluido, setConcluido] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState('')
  const [statusLocal, setStatusLocal] = useState<LicenseStatus | null>(null)
  const [confirmandoDesvinculacao, setConfirmandoDesvinculacao] = useState(false)

  // Carrega status da estação ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      setErro(null)
      setConcluido(false)
      setConfirmandoDesvinculacao(false)
      void licenseService.getLocalStatus().then((status) => {
        setStatusLocal(status)
      })
    }
  }, [isOpen])

  if (!isOpen) return null

  // 1. Ativação ou Atualização do Catálogo
  const handleConfirmarAtivacaoOuAtualizacao = async () => {
    setLoading(true)
    setErro(null)

    try {
      const res = await licenseService.activateAndDownload(organizationId, (msg) => {
        setProgresso(msg)
      })

      setMensagemSucesso(
        statusLocal?.isLicensed
          ? `Catálogo atualizado com sucesso! ${res.produtosBaixados} produtos sincronizados na memória local.`
          : `Estação vinculada com sucesso! ${res.produtosBaixados} produtos gravados no banco local.`
      )
      setConcluido(true)
      const novoStatus = await licenseService.getLocalStatus()
      setStatusLocal(novoStatus)
      onSuccess?.()
    } catch (err: any) {
      setErro(err.message || 'Ocorreu um erro durante a operação.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Desvinculação para Troca de Computador
  const handleDesvincularParaTroca = async () => {
    setLoading(true)
    setErro(null)

    try {
      const res = await licenseService.deactivateAndClearLocal((msg) => {
        setProgresso(msg)
      })

      setMensagemSucesso(res.mensagem)
      setConcluido(true)
      const novoStatus = await licenseService.getLocalStatus()
      setStatusLocal(novoStatus)
      onSuccess?.()
    } catch (err: any) {
      setErro(err.message || 'Falha ao desvincular a estação.')
    } finally {
      setLoading(false)
      setConfirmandoDesvinculacao(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3 text-amber-400">
            {statusLocal?.isLicensed ? (
              <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-6 w-6 shrink-0 text-amber-400" />
            )}
            <h2 className="text-lg font-bold text-white">
              {statusLocal?.isLicensed ? 'Gerenciar Estação Offline' : 'Ativar Modo Offline / Baixar Dados'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-300">
          {erro && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-800/80 bg-rose-950/60 p-3.5 text-rose-200">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-300">Atenção:</p>
                <p className="mt-0.5 text-xs text-rose-200/90">{erro}</p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
              <p className="font-semibold text-white">{progresso || 'Processando...'}</p>
              <p className="text-xs text-slate-400">
                Por favor, aguarde e mantenha a conexão com a internet ativa até concluir.
              </p>
            </div>
          )}

          {/* Tela de Conclusão */}
          {concluido && !loading && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 text-emerald-400">
              <CheckCircle className="h-12 w-12" />
              <p className="text-base font-bold text-white">Operação Concluída com Sucesso!</p>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                {mensagemSucesso}
              </p>
            </div>
          )}

          {/* Estado: Dispositivo JÁ VINCULADO */}
          {!loading && !concluido && statusLocal?.isLicensed && !confirmandoDesvinculacao && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                  <span>Este computador é a sua estação offline autorizada</span>
                </div>
                <div className="mt-2 text-xs text-slate-300 space-y-1">
                  <p>
                    Produtos locais salvos: <b className="text-white">{statusLocal.totalProdutosLocais}</b>
                  </p>
                  {statusLocal.activatedAt && (
                    <p className="text-slate-400">
                      Vinculado em: {new Date(statusLocal.activatedAt).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 text-xs text-slate-300">
                <p>
                  O terminal PDV está pronto para operar mesmo sem internet. Você pode atualizar o
                  catálogo local com novos produtos cadastrados na nuvem ou liberar esta máquina para
                  trocar de computador.
                </p>
              </div>

              {/* Bloco de Troca de Computador */}
              <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-4">
                <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
                  <LogOut className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>Deseja trocar de computador?</span>
                </div>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Para utilizar o modo offline em outro desktop, este computador enviará as vendas
                  pendentes para a nuvem, liberará sua licença no servidor e limpará os dados locais.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmandoDesvinculacao(true)}
                  className="mt-3 flex items-center gap-2 rounded-lg border border-rose-700/60 bg-rose-900/40 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-900/70 transition cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Trocar de Computador / Liberar Estação
                </button>
              </div>
            </div>
          )}

          {/* Estado: Confirmação de Troca de Computador */}
          {!loading && !concluido && confirmandoDesvinculacao && (
            <div className="space-y-4">
              <div className="rounded-xl border border-rose-600 bg-rose-950/50 p-4">
                <h4 className="font-bold text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
                  Confirmar Liberação para Troca de Computador
                </h4>
                <ul className="mt-2.5 list-disc list-inside space-y-1.5 text-xs text-slate-200 leading-relaxed">
                  <li>
                    Todas as vendas offline salvas neste navegador serão{' '}
                    <strong className="text-white">sincronizadas com a nuvem agora</strong>.
                  </li>
                  <li>
                    A licença deste computador será <strong className="text-white">desvinculada no servidor</strong>.
                  </li>
                  <li>
                    O banco local deste computador será <strong className="text-white">completamente limpo</strong>.
                  </li>
                  <li>
                    Você ficará liberado para acessar o sistema no <strong className="text-emerald-300">novo computador</strong> e baixar os dados lá.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Estado: Dispositivo NÃO VINCULADO (Primeira Vez) */}
          {!loading && !concluido && !statusLocal?.isLicensed && (
            <>
              <p>
                Esta ação preparará o sistema para operação sem internet, baixando todos os produtos,
                preços e saldo de estoque para o banco de dados interno deste navegador (IndexedDB).
              </p>

              <div className="rounded-xl border border-amber-600/50 bg-amber-950/40 p-4">
                <h4 className="font-bold text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Regras Importantes de Licenciamento:
                </h4>
                <ul className="mt-2 list-disc list-inside space-y-1.5 text-xs text-slate-300">
                  <li>
                    O download e ativação do modo offline só podem ser realizados{' '}
                    <strong className="text-amber-200">UMA ÚNICA VEZ</strong> por cada usuário
                    pertencente à organização.
                  </li>
                  <li>
                    Este navegador e dispositivo serão vinculados permanentemente à sua conta como
                    sua <strong className="text-white">estação de trabalho autorizada</strong>.
                  </li>
                  <li>
                    Para trocar de computador futuramente, basta usar a opção de liberação neste
                    painel com a internet conectada.
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <HardDrive className="h-4 w-4 text-blue-400 shrink-0" />
                <span>
                  O terminal PDV poderá continuar operando e emitindo vendas normalmente mesmo com a
                  rede desconectada.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
          {!concluido ? (
            <>
              {confirmandoDesvinculacao ? (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmandoDesvinculacao(false)}
                    disabled={loading}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleDesvincularParaTroca}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-500 shadow-md shadow-rose-600/30 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Sincronizar, Limpar e Liberar Licença
                  </button>
                </>
              ) : statusLocal?.isLicensed ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmarAtivacaoOuAtualizacao}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-500 shadow-md shadow-blue-600/30"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Atualizar Catálogo de Produtos
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmarAtivacaoOuAtualizacao}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-500 shadow-md shadow-blue-600/30 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    Confirmar e Ativar Licença Offline
                  </button>
                </>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
            >
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
