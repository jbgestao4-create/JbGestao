import { Printer, X, FileCheck } from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import type { SoftwareContract } from '../services/contract.service'

interface ContractPrintModalProps {
  contract: SoftwareContract | null
  isOpen: boolean
  onClose: () => void
}

export function ContractPrintModal({ contract, isOpen, onClose }: ContractPrintModalProps) {
  if (!isOpen || !contract) return null

  const handlePrint = () => {
    window.print()
  }

  const formattedDate = () => {
    try {
      const parts = contract.startDate.split('-')
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      }
    } catch {
      // fallback
    }
    return contract.startDate
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:fixed-none">
      {/* Container Principal */}
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        
        {/* Cabeçalho da Janela de Visualização (oculto na impressão) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/50 rounded-t-2xl print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Contrato de Licença e Aluguel de Software #{contract.contractNumber}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Visualização oficial para conferência, assinatura e impressão / PDF
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <Printer className="h-4 w-4" />
              Imprimir / Salvar em PDF
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="p-2 h-auto text-gray-500 hover:text-gray-700 dark:text-slate-400"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Corpo do Contrato (Documento Oficial A4) */}
        <div className="overflow-y-auto p-6 sm:p-12 text-slate-800 dark:text-slate-200 text-sm leading-relaxed print:p-0 print:overflow-visible print:text-black">
          <div className="max-w-[780px] mx-auto space-y-6">

            {/* Cabeçalho Oficial do Contrato */}
            <div className="text-center pb-6 border-b-2 border-slate-900 dark:border-slate-700 print:border-black">
              <div className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400 mb-1 print:text-black">
                {contract.licensorTradeName || contract.licensorName}
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white print:text-black uppercase tracking-tight">
                CONTRATO DE LOCAÇÃO DE SOFTWARE E PRESTAÇÃO DE SERVIÇOS (SaaS)
              </h1>
              <div className="mt-2 text-xs font-mono font-bold text-slate-500 print:text-gray-700">
                INSTRUMENTO PARTICULAR Nº {contract.contractNumber}
              </div>
            </div>

            {/* Resumo Rápido das Condições (Box Informativo) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs print:border print:border-gray-400 print:bg-white">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Mensalidade</span>
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 print:text-black">
                  {formatCurrency(contract.monthlyAmount.toFixed(2))}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Vencimento Mensal</span>
                <span className="text-sm font-black text-slate-900 dark:text-white print:text-black">
                  Todo dia {String(contract.billingDay).padStart(2, '0')}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Data de Início</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white print:text-black">
                  {contract.startDate.split('-').reverse().join('/')}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Vigência</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white print:text-black">
                  {contract.durationMonths > 0 ? `${contract.durationMonths} meses` : 'Indeterminado'}
                </span>
              </div>
            </div>

            {/* Preâmbulo / Qualificação das Partes */}
            <div className="space-y-4 text-justify">
              <p>
                Por este instrumento particular de Contrato de Licença de Uso de Software e Prestação de Serviços, de um lado:
              </p>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 print:border print:border-gray-300 print:bg-white text-xs space-y-1">
                <div className="font-bold text-slate-900 dark:text-white uppercase print:text-black">
                  CONTRATADA (LICENCIANTE):
                </div>
                <div><strong>Razão Social:</strong> {contract.licensorName}</div>
                <div><strong>CNPJ:</strong> {contract.licensorDocument}</div>
                <div><strong>Representante Legal:</strong> {contract.licensorResponsible}</div>
                <div><strong>E-mail de Contato:</strong> {contract.licensorEmail || 'Não informado'}</div>
              </div>

              <p>
                E, de outro lado:
              </p>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 print:border print:border-gray-300 print:bg-white text-xs space-y-1">
                <div className="font-bold text-slate-900 dark:text-white uppercase print:text-black">
                  CONTRATANTE (LICENCIATÁRIA):
                </div>
                <div><strong>Razão Social / Nome:</strong> {contract.clientName}</div>
                {contract.clientTradeName && (
                  <div><strong>Nome Fantasia:</strong> {contract.clientTradeName}</div>
                )}
                <div><strong>CNPJ / CPF:</strong> {contract.clientDocument}</div>
                <div><strong>Responsável pelo Contrato:</strong> {contract.clientResponsibleName} {contract.clientResponsibleDocument ? `(CPF/Doc: ${contract.clientResponsibleDocument})` : ''} {contract.clientResponsibleRole ? `• Cargo: ${contract.clientResponsibleRole}` : ''}</div>
                <div><strong>Endereço:</strong> {contract.clientAddress || 'Não informado'}</div>
                <div><strong>E-mail:</strong> {contract.clientEmail || 'Não informado'} | <strong>Telefone:</strong> {contract.clientPhone || 'Não informado'}</div>
              </div>

              <p>
                Têm, entre si, justo e acordado o presente contrato, mediante as seguintes cláusulas e condições:
              </p>
            </div>

            {/* Cláusula 1: Objeto */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide print:text-black">
                CLÁUSULA 1ª – DO OBJETO DO CONTRATO
              </h3>
              <p className="text-justify text-xs">
                1.1. O presente contrato tem por objeto a concessão de licença de uso temporária, não exclusiva e intransferível do software de gestão empresarial denominado <strong>{contract.planName}</strong>, operado sob modelo de locação (Software as a Service - SaaS), incluindo acesso à nuvem, atualizações de sistema e suporte técnico.
              </p>
              {contract.includedModules && contract.includedModules.length > 0 && (
                <p className="text-justify text-xs">
                  1.2. Fazem parte integrante do escopo contratado os módulos e funcionalidades: <strong>{contract.includedModules.join(', ')}</strong>.
                </p>
              )}
            </div>

            {/* Cláusula 2: Valores e Pagamento */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide print:text-black">
                CLÁUSULA 2ª – DOS VALORES, FORMA DE PAGAMENTO E REAJUSTE
              </h3>
              <p className="text-justify text-xs">
                2.1. Pela licença de uso e manutenção contínua da plataforma, a <strong>CONTRATANTE</strong> pagará à <strong>CONTRATADA</strong> o valor mensal de <strong>{formatCurrency(contract.monthlyAmount.toFixed(2))}</strong> ({contract.monthlyAmount > 0 ? 'reais' : 'isenção acordada'}).
              </p>
              <p className="text-justify text-xs">
                2.2. O vencimento da mensalidade ocorrerá impreterivelmente todo <strong>dia {String(contract.billingDay).padStart(2, '0')}</strong> de cada mês, a ser liquidado via <strong>{contract.paymentMethod}</strong>.
              </p>
              {contract.setupFee && contract.setupFee > 0 ? (
                <p className="text-justify text-xs">
                  2.3. Foi estipulada a taxa inicial de implantação/adesão no montante de <strong>{formatCurrency(contract.setupFee.toFixed(2))}</strong>.
                </p>
              ) : null}
              <p className="text-justify text-xs">
                2.4. O atraso no pagamento sujeitará a CONTRATANTE à multa moratória de 2% (dois por cento) sobre o valor da parcela vencida, acrescida de juros de mora legais de 1% ao mês. Após 10 (dez) dias de inadimplência, o acesso às funcionalidades poderá ser suspenso até a regularização financeira.
              </p>
            </div>

            {/* Cláusula 3: Vigência e Rescisão */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide print:text-black">
                CLÁUSULA 3ª – DO PRAZO DE VIGÊNCIA E RESCISÃO
              </h3>
              <p className="text-justify text-xs">
                3.1. Este contrato entra em vigor a partir da data de <strong>{contract.startDate.split('-').reverse().join('/')}</strong>, tendo vigência inicial de <strong>{contract.durationMonths > 0 ? `${contract.durationMonths} meses` : 'prazo indeterminado'}</strong>, renovando-se automaticamente por períodos sucessivos caso nenhuma das partes se manifeste em contrário.
              </p>
              <p className="text-justify text-xs">
                3.2. Qualquer das partes poderá rescindir o presente contrato mediante aviso prévio por escrito de, no mínimo, 30 (trinta) dias de antecedência, estando a CONTRATANTE obrigada a quitar as mensalidades devidas até o término efetivo da prestação dos serviços.
              </p>
            </div>

            {/* Cláusula 4: Suporte e SLA */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide print:text-black">
                CLÁUSULA 4ª – DO SUPORTE TÉCNICO E DISPONIBILIDADE
              </h3>
              <p className="text-justify text-xs">
                4.1. A <strong>CONTRATADA</strong> garante a prestação de suporte técnico para esclarecimento de dúvidas e correção de inconsistências da plataforma através de canais digitais (WhatsApp/E-mail/Chamado) em horário comercial regular.
              </p>
              <p className="text-justify text-xs">
                4.2. A plataforma possui rotinas automáticas de contingência e backup diário de dados, visando alta disponibilidade e estabilidade operacional.
              </p>
            </div>

            {/* Cláusula 5: LGPD e Sigilo */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide print:text-black">
                CLÁUSULA 5ª – DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS (LGPD)
              </h3>
              <p className="text-justify text-xs">
                5.1. As partes comprometem-se a guardar absoluto sigilo sobre quaisquer dados confidenciais e cadastrais aos quais tiverem acesso em razão deste instrumento, aplicando rigorosamente as diretrizes da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD).
              </p>
              <p className="text-justify text-xs">
                5.2. A base de dados inserida no sistema é de propriedade e responsabilidade integral e exclusiva da <strong>CONTRATANTE</strong>.
              </p>
            </div>

            {/* Cláusula 6: Condições Adicionais */}
            {contract.customTerms && (
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide print:text-black">
                  CLÁUSULA 6ª – DISPOSIÇÕES ESPECIAIS & OBSERVAÇÕES
                </h3>
                <p className="text-justify text-xs whitespace-pre-line bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200/60 dark:border-amber-900/60 print:border print:bg-white print:border-gray-300">
                  {contract.customTerms}
                </p>
              </div>
            )}

            {/* Cláusula do Foro */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide print:text-black">
                CLÁUSULA {contract.customTerms ? '7ª' : '6ª'} – DO FORO
              </h3>
              <p className="text-justify text-xs">
                As partes elegem o foro da Comarca de domicílio da CONTRATADA para dirimir quaisquer dúvidas ou litígios oriundos deste Contrato, renunciando a qualquer outro por mais privilegiado que seja.
              </p>
            </div>

            {/* Local e Data */}
            <div className="pt-6 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 print:text-black">
              Firmado em {formattedDate()}.
            </div>

            {/* Assinaturas */}
            <div className="pt-12 grid grid-cols-1 sm:grid-cols-2 gap-12 print:grid-cols-2 print:pt-16">
              <div className="text-center space-y-1">
                <div className="border-t border-slate-900 dark:border-slate-500 w-3/4 mx-auto pt-2 print:border-black" />
                <div className="font-bold text-xs text-slate-900 dark:text-white print:text-black uppercase">
                  {contract.licensorName}
                </div>
                <div className="text-[11px] text-slate-500 print:text-gray-700">
                  {contract.licensorResponsible}
                </div>
                <div className="text-[10px] text-slate-400 print:text-gray-600">
                  CONTRATADA (LICENCIANTE)
                </div>
              </div>

              <div className="text-center space-y-1">
                <div className="border-t border-slate-900 dark:border-slate-500 w-3/4 mx-auto pt-2 print:border-black" />
                <div className="font-bold text-xs text-slate-900 dark:text-white print:text-black uppercase">
                  {contract.clientName}
                </div>
                <div className="text-[11px] text-slate-500 print:text-gray-700">
                  Responsável: {contract.clientResponsibleName}
                </div>
                <div className="text-[10px] text-slate-400 print:text-gray-600">
                  CONTRATANTE (LICENCIATÁRIA)
                </div>
              </div>
            </div>

            {/* Testemunhas */}
            <div className="pt-10 grid grid-cols-2 gap-8 text-[11px] text-slate-400 print:text-gray-600 print:pt-12">
              <div>
                <div className="border-t border-slate-300 dark:border-slate-700 pt-1" />
                <span>Testemunha 1: ____________________________</span>
                <div className="text-[10px]">CPF:</div>
              </div>
              <div>
                <div className="border-t border-slate-300 dark:border-slate-700 pt-1" />
                <span>Testemunha 2: ____________________________</span>
                <div className="text-[10px]">CPF:</div>
              </div>
            </div>

          </div>
        </div>

        {/* Rodapé da Janela (oculto na impressão) */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/50 rounded-b-2xl print:hidden">
          <span className="text-xs text-gray-500 dark:text-slate-400">
            Dica: Ao imprimir, você pode selecionar a opção "Salvar como PDF" do navegador para enviar digitalmente ao cliente.
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button
              onClick={handlePrint}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
