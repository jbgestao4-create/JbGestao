import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { termsAcceptanceService } from '@shared/services/terms-acceptance.service'
import { Button } from '@shared/components/ui/Button'

export function TermsOfUseModal() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [isAgreed, setIsAgreed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user?.email) {
      setIsOpen(false)
      return
    }

    // Todos os cadastros novos e usuários que ainda não aceitaram devem aceitar obrigatoriamente
    const accepted = termsAcceptanceService.hasAccepted(user.email, user.user_metadata)

    if (accepted) {
      setIsOpen(false)
    } else {
      setIsOpen(true)
      setHasScrolledToBottom(false)
      setIsAgreed(false)
    }
  }, [user])

  // Verifica se o texto já cabe inteiro sem barra de rolagem (ex: telas verticais gigantes)
  useEffect(() => {
    if (!isOpen) return
    const checkScrollable = () => {
      const el = scrollContainerRef.current
      if (el && el.scrollHeight <= el.clientHeight + 10) {
        setHasScrolledToBottom(true)
      }
    }
    const timer = setTimeout(checkScrollable, 200)
    return () => clearTimeout(timer)
  }, [isOpen])

  if (!isOpen) return null

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (hasScrolledToBottom) return
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    // Se o usuário rolou até o final (tolerância de 25px para DPI e arredondamentos de zoom)
    if (scrollTop + clientHeight >= scrollHeight - 25) {
      setHasScrolledToBottom(true)
    }
  }

  const handleAccept = async () => {
    if (!isAgreed || !user?.email) return

    setIsSaving(true)
    try {
      await termsAcceptanceService.recordAcceptance(user.email, true, {
        agreedToTrialAndAutoSuspension: true,
      })
      setIsOpen(false)
    } catch {
      // Fallback em caso de erro de rede: salva localmente
      termsAcceptanceService.recordAcceptance(user.email, false)
      setIsOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      aria-describedby="terms-modal-description"
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs"
    >
      <section className="max-h-[92vh] w-full max-w-2xl flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Cabeçalho no mesmo estilo do diálogo de confirmação */}
        <div>
          <h2
            id="terms-modal-title"
            className="text-lg font-bold text-gray-900 dark:text-white"
          >
            Termos de Uso e Política de Privacidade
          </h2>
          <p
            id="terms-modal-description"
            className="mt-1 text-sm text-gray-500 dark:text-slate-400"
          >
            Role o termo até o final para liberar a caixa de aceite e clicar em Avançar.
          </p>
        </div>

        {/* Caixa de Texto Rolável com os Termos Oficiais da tela /politica-de-privacidade?tab=terms */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="my-4 max-h-[50vh] flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-700 leading-relaxed space-y-5 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300 select-text"
        >
          {/* Aviso Importante — Contrato Legalmente Vinculante */}
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-1.5 dark:border-amber-800 dark:bg-amber-950/40">
            <div className="flex items-center gap-2 text-amber-950 dark:text-amber-300 font-bold text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Aviso Importante — Contrato Legalmente Vinculante</span>
            </div>
            <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              Estes Termos e Condições de Uso (&ldquo;Termos&rdquo;) constituem um contrato legalmente
              vinculante entre você (o &ldquo;Cliente&rdquo; / &ldquo;Assinante&rdquo;) e a{' '}
              <strong>ControleSoft / JB Gestão</strong>. Ao criar uma conta, contratar um plano ou iniciar
              o período de teste de 30 dias grátis, você declara ter lido, compreendido e aceito integralmente todas as disposições aqui previstas.
            </p>
          </section>

          {/* 1. Definições */}
          <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white">1. Definições</h3>
            <ul className="space-y-1 text-slate-600 dark:text-slate-300">
              <li>• <strong>Plataforma / Serviço:</strong> O sistema SaaS multi-tenant ControleSoft / JB Gestão.</li>
              <li>• <strong>Cliente:</strong> A pessoa física ou jurídica que realiza o cadastro e assume a responsabilidade pela organização.</li>
              <li>• <strong>Usuário / Preposto:</strong> Pessoas autorizadas pelo Cliente a operar a conta.</li>
              <li>• <strong>Dados do Cliente:</strong> Registros comerciais, clientes, produtos e históricos inseridos no sistema.</li>
            </ul>
          </div>

          {/* 2. Aceitação, Capacidade e Hierarquia de Contas */}
          <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white">2. Aceitação, Capacidade e Hierarquia de Contas</h3>
            <p className="text-slate-600 dark:text-slate-300">
              O Cliente declara plena capacidade civil ou poderes de representação jurídica. O administrador é responsável exclusivo pela gestão de permissões de seus operadores e responde de forma objetiva por atos de seus prepostos (art. 932, III, do Código Civil).
            </p>
          </div>

          {/* 3. Natureza do Serviço e Isenção Fiscal */}
          <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white">3. Natureza do Serviço e Isenção Fiscal e Contábil</h3>
            <p className="text-slate-600 dark:text-slate-300">
              A Plataforma constitui ferramenta de apoio gerencial (obrigação de meio). A apuração de tributos, parametrização correta de alíquotas (NCM, CFOP, CST/CSOSN) e a emissão oficial de documentos fiscais perante os órgãos competentes (SEFAZ) são de exclusiva responsabilidade do Cliente.
            </p>
          </div>

          {/* 4. Operações Financeiras e Boletos */}
          <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white">4. Operações Financeiras, Caixa e Boletos</h3>
            <p className="text-slate-600 dark:text-slate-300">
              A Plataforma não é uma instituição financeira. Lançamentos de caixa, baixas e extração de dados de boletos bancários em PDF são controles gerenciais internos e não liquidam títulos na rede bancária comercial, cabendo ao Cliente a conferência de valores antes do pagamento no seu banco.
            </p>
          </div>

          {/* 5. Segurança de Credenciais e Senhas de Aparelhos (O.S.) */}
          <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white">5. Segurança de Credenciais e Senhas de Aparelhos (O.S.)</h3>
            <p className="text-slate-600 dark:text-slate-300">
              As credenciais de login são pessoais e intransferíveis. O armazenamento de senhas de aparelhos de clientes finais em ordens de serviço é de inteira responsabilidade civil e legal do Cliente e de seus técnicos.
            </p>
          </div>

          {/* 6. Período de Teste (Trial de 30 Dias) e Pagamentos */}
          <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white">6. Período de Teste (Trial de 30 Dias) e Assinatura</h3>
            <p className="text-slate-600 dark:text-slate-300">
              Novas organizações possuem 30 (trinta) dias de avaliação gratuita sem cobrança imediata. Ao término dos 30 dias de teste, a continuidade do acesso fica condicionada ao pagamento da assinatura mensal correspondente ao plano adquirido.
            </p>
          </div>

          {/* 7. Condutas Proibidas */}
          <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white">7. Condutas Proibidas</h3>
            <p className="text-slate-600 dark:text-slate-300">
              É terminantemente proibido utilizar o sistema para fraudes, sonegação fiscal, compartilhamento indevido de acessos ou engenharia reversa do código-fonte.
            </p>
          </div>

          {/* 8. Propriedade Intelectual & 9. LGPD */}
          <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white">8. Propriedade Intelectual & 9. LGPD</h3>
            <p className="text-slate-600 dark:text-slate-300">
              A marca, interfaces e softwares são propriedade exclusiva da ControleSoft. Para os fins da LGPD (Lei nº 13.709/2018), o Cliente atua como Controlador dos dados de seus clientes finais e a ControleSoft atua como Operadora da infraestrutura em nuvem com isolamento de dados por RLS.
            </p>
          </div>

          {/* 10. Disponibilidade, 11. Limitação de Responsabilidade e 12. Indenização */}
          <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white">10. Disponibilidade e Limitação de Responsabilidade</h3>
            <p className="text-slate-600 dark:text-slate-300">
              O serviço opera em melhores esforços comerciais. Não respondemos por lucros cessantes ou danos indiretos. A responsabilidade indenizatória agregada fica limitada ao valor efetivamente pago pelo Cliente nos últimos 3 (três) meses anteriores ao evento.
            </p>
          </div>

          {/* 13. Cancelamento, 14. Foro e Contato */}
          <div className="space-y-1.5">
            <h3 className="font-bold text-slate-900 dark:text-white">13. Cancelamento, 14. Vigência e Foro</h3>
            <p className="text-slate-600 dark:text-slate-300">
              O cancelamento pode ser efetuado a qualquer momento sem multa. Estes termos regem-se pelas leis brasileiras com foro na comarca da operadora da plataforma. Contato oficial:{' '}
              <a href="mailto:controlesoft@outlook.com" className="text-blue-600 underline">
                controlesoft@outlook.com
              </a>
              .
            </p>
          </div>

          <div className="pt-2 text-center text-[10px] text-slate-400 font-mono">
            — Fim dos Termos e Condições de Uso —
          </div>
        </div>

        {/* Alerta de Rolagem / Confirmação */}
        {!hasScrolledToBottom ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            <ArrowDown className="h-4 w-4 shrink-0 animate-bounce text-amber-600" />
            <span>Por favor, role a barra do texto acima até o final para habilitar o aceite.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Rolagem concluída. Marque a caixa abaixo para liberar o botão Avançar.</span>
          </div>
        )}

        {/* Checkbox de Aceite */}
        <label
          className={`mt-3 flex items-start gap-2.5 rounded-lg border p-3 transition-colors select-none ${
            hasScrolledToBottom
              ? 'border-blue-200 bg-blue-50/40 hover:bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30 cursor-pointer'
              : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-slate-800 dark:bg-slate-800/40 cursor-not-allowed opacity-60'
          }`}
        >
          <input
            type="checkbox"
            disabled={!hasScrolledToBottom}
            checked={isAgreed}
            onChange={(e) => setIsAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
          />
          <span className="text-xs font-medium text-gray-800 dark:text-slate-200 leading-relaxed">
            Li e aceito os <strong>Termos de Uso</strong> e a <strong>Política de Privacidade</strong> da plataforma ControleSoft / JB Gestão, incluindo as condições de licenciamento e os 30 dias de teste grátis.
          </span>
        </label>

        {/* Rodapé com botão Avançar à direita no mesmo layout do print */}
        <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-slate-800">
          <Button
            type="button"
            disabled={!isAgreed || isSaving}
            onClick={handleAccept}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          >
            {isSaving ? 'Salvando...' : 'Avançar'}
          </Button>
        </div>
      </section>
    </div>
  )
}
