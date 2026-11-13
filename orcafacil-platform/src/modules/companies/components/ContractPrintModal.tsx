import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X, FileCheck, FileText } from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import type { SoftwareContract } from '../services/contract.service'

interface ContractPrintModalProps {
  contract: SoftwareContract | null
  isOpen: boolean
  onClose: () => void
}

export function ContractPrintModal({ contract, isOpen, onClose }: ContractPrintModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

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

  const modalContent = (
    <div className="contract-print-portal fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      {/* Estilos dedicados e isolados de impressão para folha A4 oficial */}
      <style>{`
        @media print {
          /* Oculta totalmente o aplicativo de fundo (sidebar, páginas, tabelas, etc.) */
          #root,
          .no-print,
          .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
          }

          /* Configurações oficiais de folha A4 e margens adequadas para contrato */
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }

          html,
          body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: auto !important;
            overflow: visible !important;
          }

          /* Transforma a modal em um fluxo normal e contínuo de documento A4 */
          .contract-print-portal {
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            box-shadow: none !important;
            border: none !important;
          }

          .contract-print-container {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }

          .contract-print-body {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            background: #ffffff !important;
          }

          .contract-paper {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Times New Roman', Times, Georgia, serif !important;
            font-size: 10pt !important;
            line-height: 1.45 !important;
            text-align: justify !important;
          }

          /* Força texto, bordas e divisores em preto de alta definição */
          .contract-paper * {
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .contract-table {
            border: 1px solid #000000 !important;
            border-collapse: collapse !important;
            width: 100% !important;
            margin: 3mm 0 !important;
          }

          .contract-table th,
          .contract-table td {
            border: 1px solid #000000 !important;
            padding: 3.5px 6px !important;
            font-size: 8.5pt !important;
            color: #000000 !important;
            background-color: transparent !important;
          }

          .contract-table th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }

          /* Controle de quebras de página */
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .contract-clause {
            margin-bottom: 3.5mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .contract-clause h3 {
            font-size: 10pt !important;
            font-weight: bold !important;
            text-transform: uppercase !important;
            margin-bottom: 1.5mm !important;
            color: #000000 !important;
          }

          .contract-clause p {
            text-indent: 7mm !important;
            margin-bottom: 1.5mm !important;
            font-size: 10pt !important;
            line-height: 1.45 !important;
            color: #000000 !important;
          }

          .contract-signature-block {
            margin-top: 8mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Container Principal da Modal */}
      <div className="contract-print-container relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col max-h-[94vh]">
        
        {/* Cabeçalho da Janela de Visualização (oculto na impressão) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/90 dark:bg-slate-800/60 rounded-t-2xl no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Contrato de Locação de Software #{contract.contractNumber}
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                  {contract.planName}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Visualização oficial formatada em padrão A4 para conferência, assinatura e impressão
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm font-semibold text-xs sm:text-sm"
            >
              <Printer className="h-4 w-4" />
              Imprimir / Salvar em PDF
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="p-2 h-auto text-gray-500 hover:text-gray-700 dark:text-slate-400"
              title="Fechar visualização"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Corpo com visual de Papel A4 */}
        <div className="contract-print-body overflow-y-auto p-4 sm:p-8 bg-slate-100/70 dark:bg-slate-950/50 flex justify-center">
          <div className="contract-paper w-full max-w-[780px] bg-white text-gray-900 shadow-xl border border-gray-300/80 p-6 sm:p-12 space-y-5 rounded-xs">

            {/* Cabeçalho Oficial do Contrato */}
            <div className="text-center pb-4 border-b-2 border-slate-900">
              <div className="text-xs font-black uppercase tracking-widest text-purple-700 mb-1">
                {contract.licensorTradeName || contract.licensorName}
              </div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                CONTRATO DE LOCAÇÃO DE SOFTWARE E PRESTAÇÃO DE SERVIÇOS (SaaS)
              </h1>
              <div className="mt-1 text-xs font-mono font-bold text-slate-600">
                INSTRUMENTO PARTICULAR Nº {contract.contractNumber}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                PLATAFORMA EM NUVEM • GESTÃO EMPRESARIAL • ATUALIZAÇÕES E SUPORTE TÉCNICO
              </div>
            </div>

            {/* Quadro Resumo das Condições Comerciais */}
            <div className="print-avoid-break">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                QUADRO RESUMO DAS CONDIÇÕES DA LICENÇA
              </div>
              <table className="contract-table w-full text-left text-xs border border-slate-400">
                <tbody>
                  <tr>
                    <td className="w-1/4 font-bold bg-slate-50 border border-slate-300 p-2">Licenciante (Contratada):</td>
                    <td className="w-1/4 border border-slate-300 p-2 font-medium">{contract.licensorName}</td>
                    <td className="w-1/4 font-bold bg-slate-50 border border-slate-300 p-2">CNPJ Licenciante:</td>
                    <td className="w-1/4 border border-slate-300 p-2 font-mono">{contract.licensorDocument}</td>
                  </tr>
                  <tr>
                    <td className="font-bold bg-slate-50 border border-slate-300 p-2">Licenciatária (Cliente):</td>
                    <td className="border border-slate-300 p-2 font-bold">{contract.clientName}</td>
                    <td className="font-bold bg-slate-50 border border-slate-300 p-2">CNPJ / CPF Cliente:</td>
                    <td className="border border-slate-300 p-2 font-mono">{contract.clientDocument || 'Não informado'}</td>
                  </tr>
                  <tr>
                    <td className="font-bold bg-slate-50 border border-slate-300 p-2">Plano Contratado:</td>
                    <td className="border border-slate-300 p-2 font-bold text-purple-700">{contract.planName}</td>
                    <td className="font-bold bg-slate-50 border border-slate-300 p-2">Mensalidade:</td>
                    <td className="border border-slate-300 p-2 font-bold text-emerald-700">
                      {formatCurrency(contract.monthlyAmount.toFixed(2))} / mês
                    </td>
                  </tr>
                  <tr>
                    <td className="font-bold bg-slate-50 border border-slate-300 p-2">Data de Início:</td>
                    <td className="border border-slate-300 p-2">{contract.startDate.split('-').reverse().join('/')}</td>
                    <td className="font-bold bg-slate-50 border border-slate-300 p-2">Dia do Vencimento:</td>
                    <td className="border border-slate-300 p-2 font-semibold">Todo dia {String(contract.billingDay).padStart(2, '0')}</td>
                  </tr>
                  <tr>
                    <td className="font-bold bg-slate-50 border border-slate-300 p-2">Prazo de Vigência:</td>
                    <td className="border border-slate-300 p-2">
                      {contract.durationMonths > 0 ? `${contract.durationMonths} meses` : 'Prazo Indeterminado'}
                    </td>
                    <td className="font-bold bg-slate-50 border border-slate-300 p-2">Forma de Pagamento:</td>
                    <td className="border border-slate-300 p-2">{contract.paymentMethod}</td>
                  </tr>
                  {contract.hasTrialPeriod ? (
                    <tr>
                      <td className="font-bold bg-slate-50 border border-slate-300 p-2">Período de Teste:</td>
                      <td colSpan={3} className="border border-slate-300 p-2 font-bold text-emerald-700">
                        1 Mês Gratuito (Isenção total da mensalidade no 1º mês)
                      </td>
                    </tr>
                  ) : null}
                  {contract.setupFee && contract.setupFee > 0 ? (
                    <tr>
                      <td className="font-bold bg-slate-50 border border-slate-300 p-2">Taxa de Implantação:</td>
                      <td colSpan={3} className="border border-slate-300 p-2 font-bold">
                        {formatCurrency(contract.setupFee.toFixed(2))}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Preâmbulo / Qualificação das Partes */}
            <div className="space-y-3 text-justify text-xs leading-relaxed print-avoid-break">
              <p>
                Pelo presente instrumento particular de Contrato de Licença de Uso de Software e Prestação de Serviços Técnicos:
              </p>

              <p>
                <strong>DE UM LADO, COMO LICENCIANTE (CONTRATADA):</strong>{' '}
                <strong>{contract.licensorName}</strong>
                {contract.licensorTradeName ? ` (nome fantasia "${contract.licensorTradeName}")` : ''}, pessoa jurídica inscrita no CNPJ sob o nº <strong>{contract.licensorDocument}</strong>, com sede em {contract.licensorAddress || 'Brasil'}, neste ato representada na forma de seu contrato social por seu responsável legal <strong>{contract.licensorResponsible}</strong>, doravante denominada simplesmente <strong>LICENCIANTE</strong>;
              </p>

              <p>
                <strong>E, DE OUTRO LADO, COMO LICENCIATÁRIA (CONTRATANTE):</strong>{' '}
                <strong>{contract.clientName}</strong>
                {contract.clientTradeName ? ` (nome fantasia "${contract.clientTradeName}")` : ''}, inscrita no CNPJ/CPF sob o nº <strong>{contract.clientDocument || 'conforme cadastro'}</strong>, com sede/endereço em {contract.clientAddress || 'endereço registrado no sistema'}, neste ato representada por seu responsável legal <strong>{contract.clientResponsibleName}</strong>
                {contract.clientResponsibleDocument ? `, portador(a) do documento nº ${contract.clientResponsibleDocument}` : ''}
                {contract.clientResponsibleRole ? `, exercendo a função de ${contract.clientResponsibleRole}` : ''}, com telefone {contract.clientPhone || 'cadastrado'} e e-mail {contract.clientEmail || 'cadastrado'}, doravante denominada simplesmente <strong>LICENCIATÁRIA</strong>;
              </p>

              <p>
                Têm, entre si, justo e contratado o presente instrumento particular, que se regerá pelas seguintes cláusulas e condições mutuamente aceitas e outorgadas:
              </p>
            </div>

            {/* Cláusula 1: Objeto */}
            <div className="contract-clause space-y-1.5 text-xs text-justify">
              <h3 className="font-bold text-slate-900 uppercase">
                CLÁUSULA 1ª – DO OBJETO DO CONTRATO
              </h3>
              <p>
                1.1. O presente contrato tem por objeto a concessão de licença de uso temporária, não exclusiva e intransferível do software de gestão empresarial denominado <strong>{contract.planName}</strong>, operado sob modelo de locação (Software as a Service - SaaS), incluindo acesso aos servidores em nuvem, rotinas de segurança, atualizações contínuas de versão e suporte técnico operacional.
              </p>
              {contract.includedModules && contract.includedModules.length > 0 && (
                <p>
                  1.2. Fazem parte integrante do escopo da licença contratada os seguintes módulos e funcionalidades do plano: <strong>{contract.includedModules.join(', ')}</strong>.
                </p>
              )}
              <p>
                1.3. A licença conferida pelo presente instrumento não transfere à LICENCIATÁRIA a propriedade intelectual do código-fonte, arquitetura ou direitos autorais do software, permanecendo estes como propriedade exclusiva da LICENCIANTE.
              </p>
            </div>

            {/* Cláusula 2: Valores e Pagamento */}
            <div className="contract-clause space-y-1.5 text-xs text-justify">
              <h3 className="font-bold text-slate-900 uppercase">
                CLÁUSULA 2ª – DOS VALORES, FORMAS DE PAGAMENTO E REAJUSTES
              </h3>
              <p>
                2.1. Pela locação mensal da plataforma, manutenção e infraestrutura, a <strong>LICENCIATÁRIA</strong> pagará à <strong>LICENCIANTE</strong> o valor mensal recorrente de <strong>{formatCurrency(contract.monthlyAmount.toFixed(2))}</strong> ({contract.monthlyAmount > 0 ? 'reais' : 'isenção concedida'}).
              </p>
              {contract.hasTrialPeriod ? (
                <p>
                  2.1.1. <strong>PERÍODO DE TESTE GRATUITO (DEGUSTAÇÃO):</strong> Fica expressamente concedido à <strong>LICENCIATÁRIA</strong> o benefício de <strong>01 (um) mês de teste gratuito</strong>, contado a partir da data de início deste instrumento, durante o qual não haverá cobrança de mensalidade pelo uso do software. A cobrança da mensalidade regular estipulada no item 2.1 terá início apenas a partir do 2º mês de contrato.
                </p>
              ) : null}
              <p>
                2.2. A mensalidade vencerá impreterivelmente todo <strong>dia {String(contract.billingDay).padStart(2, '0')}</strong> de cada mês subsequente ao início da prestação, a ser quitada preferencialmente via <strong>{contract.paymentMethod}</strong>.
              </p>
              {contract.setupFee && contract.setupFee > 0 ? (
                <p>
                  2.3. Foi estipulada a taxa inicial de adesão/implantação no montante de <strong>{formatCurrency(contract.setupFee.toFixed(2))}</strong>.
                </p>
              ) : null}
              <p>
                2.4. O atraso no pagamento sujeitará a LICENCIATÁRIA ao acréscimo de multa moratória de 2% (dois por cento) sobre o valor do débito, somada a juros de mora legais de 1% (um por cento) ao mês calculados pro rata die.
              </p>
              <p>
                2.5. Após 10 (dez) dias corridos de inadimplência sem justificativa aceita pela LICENCIANTE, o acesso ao software poderá ser preventivamente bloqueado ou suspenso até a efetiva regularização financeira, sem prejuízo da cobrança das mensalidades devidas.
              </p>
              <p>
                2.6. O valor da mensalidade poderá ser reajustado anualmente com base na variação positiva do índice oficial de inflação (IPCA ou IGP-M acumulado no período), ou por acordo mútuo em caso de ampliação de módulos.
              </p>
            </div>

            {/* Cláusula 3: Vigência e Rescisão */}
            <div className="contract-clause space-y-1.5 text-xs text-justify">
              <h3 className="font-bold text-slate-900 uppercase">
                CLÁUSULA 3ª – DO PRAZO DE VIGÊNCIA E RESCISÃO
              </h3>
              <p>
                3.1. Este contrato entra em vigor a partir da data de <strong>{contract.startDate.split('-').reverse().join('/')}</strong>, tendo vigência inicial de <strong>{contract.durationMonths > 0 ? `${contract.durationMonths} meses` : 'prazo indeterminado'}</strong>, renovando-se automaticamente por períodos iguais e sucessivos, exceto manifestação em contrário.
              </p>
              <p>
                3.2. Qualquer das partes poderá rescindir o presente instrumento a qualquer momento mediante aviso prévio formal e por escrito de, no mínimo, 30 (trinta) dias de antecedência, permanecendo a LICENCIATÁRIA responsável pela liquidação das mensalidades até o encerramento do prazo de aviso.
              </p>
              <p>
                3.3. Em caso de rescisão, a LICENCIATÁRIA terá assegurado o direito de exportar suas bases cadastrais (clientes, produtos, movimentações) em formato padrão legível antes do encerramento definitivo do acesso.
              </p>
            </div>

            {/* Cláusula 4: Suporte e Disponibilidade */}
            <div className="contract-clause space-y-1.5 text-xs text-justify">
              <h3 className="font-bold text-slate-900 uppercase">
                CLÁUSULA 4ª – DO SUPORTE TÉCNICO, ATUALIZAÇÕES E SEGURANÇA
              </h3>
              <p>
                4.1. A <strong>LICENCIANTE</strong> prestará atendimento de suporte técnico para esclarecimento de dúvidas e diagnóstico operacional em dias úteis e horário comercial, realizado exclusivamente via <strong>E-mail</strong> ({contract.licensorEmail || 'contato@jbsoftware.com.br'}) e pelo <strong>Chat de Suporte</strong> disponibilizado internamente dentro da própria plataforma do sistema.
              </p>
              <p>
                4.2. A LICENCIANTE manterá rotinas automáticas de backup diário de dados, proteção de integridade e servidores de alta disponibilidade para operação segura do sistema.
              </p>
            </div>

            {/* Cláusula 5: LGPD e Sigilo */}
            <div className="contract-clause space-y-1.5 text-xs text-justify">
              <h3 className="font-bold text-slate-900 uppercase">
                CLÁUSULA 5ª – DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS (LGPD)
              </h3>
              <p>
                5.1. Ambas as partes comprometem-se a cumprir integralmente as determinações da Lei Geral de Proteção de Dados Pessoais (Lei Federal nº 13.709/2018 - LGPD), garantindo sigilo absoluto sobre informações comerciais, cadastrais e estratégicas compartilhadas.
              </p>
              <p>
                5.2. A base de dados inserida no software é de titularidade e responsabilidade integral e exclusiva da <strong>LICENCIATÁRIA</strong>, cabendo a esta a legitimidade das informações registradas.
              </p>
            </div>

            {/* Cláusula 6: Condições Adicionais (se preenchidas) */}
            {contract.customTerms && (
              <div className="contract-clause space-y-1.5 text-xs text-justify">
                <h3 className="font-bold text-slate-900 uppercase">
                  CLÁUSULA 6ª – DISPOSIÇÕES ESPECIAIS & OBSERVAÇÕES
                </h3>
                <p className="whitespace-pre-line p-2 border border-slate-300 bg-slate-50/50 rounded-xs">
                  {contract.customTerms}
                </p>
              </div>
            )}

            {/* Cláusula do Foro */}
            <div className="contract-clause space-y-1.5 text-xs text-justify">
              <h3 className="font-bold text-slate-900 uppercase">
                CLÁUSULA {contract.customTerms ? '7ª' : '6ª'} – DO FORO COMPETENTE
              </h3>
              <p>
                Para dirimir quaisquer controvérsias decorrentes da interpretação ou execução deste Contrato, as partes elegem o Foro da Comarca de domicílio da LICENCIANTE, renunciando a qualquer outro por mais privilegiado que seja.
              </p>
            </div>

            {/* Fechamento: Local e Data */}
            <div className="pt-4 text-center text-xs font-semibold text-slate-800 print-avoid-break">
              E, por estarem assim justas e contratadas, as partes firmam o presente instrumento em vias de igual teor e forma.
              <div className="mt-2 font-bold">
                Firmado aos {formattedDate()}.
              </div>
            </div>

            {/* Assinaturas */}
            <div className="contract-signature-block pt-8 grid grid-cols-2 gap-8 text-center text-xs print-avoid-break">
              <div className="space-y-1">
                <div className="border-t-2 border-slate-900 w-4/5 mx-auto pt-2" />
                <div className="font-bold text-slate-900 uppercase">
                  {contract.licensorName}
                </div>
                <div className="text-[11px] text-slate-600">
                  {contract.licensorResponsible}
                </div>
                <div className="text-[10px] text-slate-500 font-semibold">
                  LICENCIANTE (CONTRATADA)
                </div>
              </div>

              <div className="space-y-1">
                <div className="border-t-2 border-slate-900 w-4/5 mx-auto pt-2" />
                <div className="font-bold text-slate-900 uppercase">
                  {contract.clientName}
                </div>
                <div className="text-[11px] text-slate-600">
                  {contract.clientResponsibleName}
                </div>
                <div className="text-[10px] text-slate-500 font-semibold">
                  LICENCIATÁRIA (CONTRATANTE)
                </div>
              </div>
            </div>

            {/* Rodapé Oficial da Folha */}
            <div className="pt-6 border-t border-slate-300 text-center text-[10px] text-slate-400 print-avoid-break">
              Instrumento Particular de Licença de Software (SaaS) • Contrato #{contract.contractNumber} • Licenciante: {contract.licensorName}
            </div>

          </div>
        </div>

        {/* Rodapé da Janela de Visualização (oculto na impressão) */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50/90 dark:bg-slate-800/60 rounded-b-2xl no-print">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>
              <strong>Dica de Impressão:</strong> Na janela de impressão, certifique-se de selecionar a opção <em>"Salvar como PDF"</em> ou sua impressora física. As margens e quebras de página são calculadas automaticamente.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} className="text-xs">
              Fechar
            </Button>
            <Button
              onClick={handlePrint}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-xs"
            >
              <Printer className="h-4 w-4" />
              Imprimir / Salvar em PDF
            </Button>
          </div>
        </div>

      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null
}
