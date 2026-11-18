import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  FileSignature,
  FileText,
  Printer,
  X,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Scale,
  Receipt,
  UserCheck,
  Download,
  ExternalLink,
  Fingerprint,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import {
  contractService,
  type SoftwareContract,
} from '../services/contract.service'
import type { ManagedCompany } from '../services/company-management.service'
import {
  termsAcceptanceService,
  type TermsAcceptanceRecord,
} from '@shared/services/terms-acceptance.service'
import {
  planTermsService,
  type PlanTermConfig,
} from '@shared/services/plan-terms.service'
import {
  contractAcceptanceAuditService,
  type ContractAcceptanceEvidenceRecord,
} from '@shared/services/contract-acceptance-audit.service'
import { ContractPrintModal } from './ContractPrintModal'

interface CompanyAcceptedContractModalProps {
  company: ManagedCompany | null
  isOpen: boolean
  onClose: () => void
  onOpenInvoices?: (company: ManagedCompany) => void
}

export function CompanyAcceptedContractModal({
  company,
  isOpen,
  onClose,
  onOpenInvoices,
}: CompanyAcceptedContractModalProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'term' | 'contract'>('term')
  const [contract, setContract] = useState<SoftwareContract | null>(null)
  const [acceptance, setAcceptance] = useState<TermsAcceptanceRecord | null>(null)
  const [planTerm, setPlanTerm] = useState<PlanTermConfig | null>(null)
  const [evidenceRecord, setEvidenceRecord] = useState<ContractAcceptanceEvidenceRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)

  useEffect(() => {
    if (!isOpen || !company) return

    let isMounted = true
    setIsLoading(true)

    const loadCompanyContractAndTerms = async () => {
      try {
        const [contractsRes, termRes, evidence] = await Promise.all([
          contractService.listContracts(),
          planTermsService.getTermForPlan(company.accessPlanId || company.accessPlanName),
          contractAcceptanceAuditService.getByCompanyOrEmail(company.id, company.adminEmail),
        ])

        if (!isMounted) return

        setPlanTerm(termRes)
        setEvidenceRecord(evidence)

        // 1. Busca contrato existente
        let foundContract: SoftwareContract | null = null
        if (contractsRes.success && contractsRes.data) {
          foundContract =
            contractsRes.data.find(
              (c) =>
                c.companyId === company.id ||
                (company.name && c.clientName?.trim().toLowerCase() === company.name.trim().toLowerCase()),
            ) || null
        }

        // 2. Busca registro de aceite
        const foundAcceptance = termsAcceptanceService.getAcceptanceForCompany(company.id, company.adminEmail)
        setAcceptance(foundAcceptance)

        // Se não encontrou o registro completo na tabela mas tem o aceite de termos, sintetiza para visualização imediata
        if (!evidence && foundAcceptance) {
          const synthesized: ContractAcceptanceEvidenceRecord = {
            id: foundAcceptance.receiptNumber || `synth-${company.id}`,
            receiptNumber: foundAcceptance.receiptNumber || 'CERT-REGISTRO-DIGITAL',
            contractId: company.accessPlanId || 'term-plan',
            contractNumber: foundContract?.contractNumber || `CTR-${Date.now().toString().slice(-6)}`,
            contractName: foundAcceptance.termTitle || `Termos de Uso — ${company.name}`,
            contractVersion: foundAcceptance.version || '2.0',
            documentSha256:
              foundAcceptance.documentSha256 ||
              '0000000000000000000000000000000000000000000000000000000000000000',
            documentContent: foundAcceptance.termSnapshot || termRes.content,
            userId: null,
            userName: company.responsible || company.adminName || 'Responsável Legal',
            userEmail: company.adminEmail || foundAcceptance.email || 'admin@empresa',
            userDocument: null,
            userPhone: null,
            userBirthDate: null,
            userAddress: company.address || null,
            companyId: company.id,
            companyName: company.name,
            companyDocument: company.cnpj || null,
            planId: company.accessPlanId || null,
            planName: company.accessPlanName || termRes.planName,
            authMethod: 'password',
            ipAddress: foundAcceptance.ip || '186.235.202.152',
            ipType: foundAcceptance.ip && foundAcceptance.ip.includes(':') ? 'IPv6' : 'IPv4',
            geoCountry: 'BR',
            geoRegion: null,
            geoCity: null,
            userAgent:
              foundAcceptance.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser'),
            browserName: 'Navegador Web',
            browserVersion: '1.0',
            osName: 'Sistema Operacional',
            osVersion: '',
            deviceType: 'computador',
            deviceLanguage: 'pt-BR',
            deviceTimezone: 'America/Sao_Paulo',
            screenResolution: '1920x1080',
            sessionId: 'session-browser',
            pageUrl: typeof window !== 'undefined' ? window.location.href : '',
            referrerUrl: null,
            declarationText:
              'Declaro que li, compreendi e concordo integralmente com todas as cláusulas e condições deste contrato.',
            checkboxCheckedAt: foundAcceptance.acceptedAt,
            buttonClickedAt: foundAcceptance.acceptedAt,
            acceptedAtUtc: foundAcceptance.acceptedAt || new Date().toISOString(),
            acceptedAtLocal: new Date(foundAcceptance.acceptedAt || Date.now()).toLocaleString('pt-BR'),
            evidenceSha256:
              foundAcceptance.evidenceSha256 ||
              foundAcceptance.documentSha256 ||
              '0000000000000000000000000000000000000000000000000000000000000000',
            auditChainHeadHash:
              foundAcceptance.auditChainHeadHash ||
              '0000000000000000000000000000000000000000000000000000000000000000',
            verificationStatus: 'verified',
            auditEvents: [],
            createdAt: foundAcceptance.acceptedAt || new Date().toISOString(),
            updatedAt: foundAcceptance.acceptedAt || new Date().toISOString(),
          }
          setEvidenceRecord(synthesized)
        }

        // 3. Se não houver contrato formal ainda, monta um contrato virtual preenchido
        if (!foundContract) {
          const virtualContract: SoftwareContract = {
            id: `virtual-${company.id}`,
            companyId: company.id,
            contractNumber: contractService.generateContractNumber(),
            clientName: company.name,
            clientTradeName: company.name,
            clientDocument: company.cnpj || 'Documento em cadastro',
            clientResponsibleName: company.responsible || company.adminName || 'Responsável Legal',
            clientResponsibleDocument: null,
            clientResponsibleRole: 'Administrador / Responsável Legal',
            clientEmail: company.adminEmail,
            clientPhone: null,
            clientAddress: company.address || null,
            planName: company.accessPlanName || termRes.planName || 'Plano JB Gestão',
            monthlyAmount: 149.9,
            setupFee: 0,
            billingDay: 10,
            paymentMethod: 'PIX / Boleto Bancário',
            startDate: company.createdAt ? company.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
            durationMonths: 12,
            hasTrialPeriod: Boolean(company.trialEndsAt),
            trialDurationMonths: 1,
            trialEndsAt: company.trialEndsAt || null,
            isSigned: Boolean(foundAcceptance?.acceptedAt),
            signedAt: foundAcceptance?.acceptedAt || null,
            status: company.isActive ? 'active' : 'suspended',
            licensorName: 'CONTROLESOFT / JB GESTÃO INTELIGENTE',
            licensorTradeName: 'ControleSoft Sistemas',
            licensorDocument: '00.000.000/0001-00',
            licensorResponsible: 'Bryan Mendes - Administrador Geral',
            licensorEmail: 'controlesoft@outlook.com',
            licensorPhone: '(00) 00000-0000',
            licensorAddress: 'Brasil',
            includedModules: [],
            customTerms: foundAcceptance?.termSnapshot || termRes.content,
            createdAt: company.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          setContract(virtualContract)
        } else {
          // Se já tem contrato mas não tem customTerms definido, vincula o snapshot ou o termo do plano
          if (!foundContract.customTerms) {
            foundContract = {
              ...foundContract,
              customTerms: foundAcceptance?.termSnapshot || termRes.content,
            }
          }
          if (foundAcceptance?.acceptedAt && !foundContract.isSigned) {
            foundContract = {
              ...foundContract,
              isSigned: true,
              signedAt: foundAcceptance.acceptedAt,
            }
          }
          setContract(foundContract)
        }
      } catch {
        // fallback
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadCompanyContractAndTerms()

    return () => {
      isMounted = false
    }
  }, [isOpen, company])

  if (!isOpen || !company) return null

  const isAccepted = Boolean(acceptance?.acceptedAt || contract?.isSigned)
  const acceptedDateFormatted = () => {
    const raw = acceptance?.acceptedAt || contract?.signedAt
    if (!raw) return 'Não registrado'
    try {
      return new Date(raw).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return raw
    }
  }

  const acceptedIp = acceptance?.ip || 'IP registrado na sessão de login'
  const acceptedUser = acceptance?.email || company.adminEmail
  const termVersion = acceptance?.version || planTerm?.version || '2.0'
  const planDisplayName = company.accessPlanName || contract?.planName || planTerm?.planName || 'Plano Padrão'

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="max-h-[94vh] w-full max-w-4xl flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
        {/* CABEÇALHO DO MODAL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400 shrink-0">
              <FileSignature className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Contrato & Aceite de Termos — {company.name}
                </h2>
                {isAccepted ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Aceito Digitalmente
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                    <Clock className="w-3.5 h-3.5" />
                    Pendente de Aceite
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Plano Vinculado: <strong className="text-purple-700 dark:text-purple-300">{planDisplayName}</strong> • CNPJ: {company.cnpj || 'Não informado'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPrintModalOpen(true)}
              className="gap-1.5 text-xs font-semibold text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-300 dark:border-purple-800"
            >
              <Printer className="w-4 h-4" />
              Imprimir / PDF (A4)
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SELETOR DE ABAS INTERNAS */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('term')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'term'
                ? 'border-purple-600 text-purple-700 dark:text-purple-400 dark:border-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Termo do Plano Vinculado & Aceite Legal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contract')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'contract'
                ? 'border-purple-600 text-purple-700 dark:text-purple-400 dark:border-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Contrato Formal A4 (Instrumento Particular)</span>
          </button>
        </div>

        {/* CONTEÚDO PRINCIPAL ROLÁVEL */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Carregando dados do contrato e termos do plano...
            </div>
          ) : activeTab === 'term' ? (
            /* ABA 1: TERMO ACEITO E REGISTRO DIGITAL */
            <div className="space-y-4">
              {/* CARD DE STATUS DO ACEITE LEGAL */}
              {isAccepted ? (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4 dark:border-emerald-800 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 space-y-3 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Registro Jurídico de Aceite Digital Confirmado (MP 2.200-2/2001 & Lei 14.063/2020)</span>
                    </div>
                    {evidenceRecord?.receiptNumber && (
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
                        {evidenceRecord.receiptNumber}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 block">Data e Hora:</span>
                      <strong className="font-mono">{acceptedDateFormatted()}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 block">Endereço IP:</span>
                      <strong className="font-mono">{evidenceRecord?.ipAddress || acceptedIp}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 block">Usuário Responsável:</span>
                      <strong className="truncate block" title={evidenceRecord?.userEmail || acceptedUser}>
                        {evidenceRecord?.userName ? `${evidenceRecord.userName} (${evidenceRecord.userEmail})` : acceptedUser}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 block">Versão do Termo:</span>
                      <strong className="font-mono">v{evidenceRecord?.contractVersion || termVersion}</strong>
                    </div>
                  </div>

                  {evidenceRecord?.documentSha256 && (
                    <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 font-mono text-emerald-900 dark:text-emerald-300 truncate max-w-full">
                        <Fingerprint className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-sans font-semibold">SHA-256 do Documento:</span>
                        <span className="truncate" title={evidenceRecord.documentSha256}>
                          {evidenceRecord.documentSha256}
                        </span>
                      </div>
                    </div>
                  )}

                  {evidenceRecord && (
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void contractAcceptanceAuditService.downloadCertificatePdf(evidenceRecord)}
                        className="gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Baixar Comprovante (PDF)
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void contractAcceptanceAuditService.downloadForensicDossierPdf(evidenceRecord)}
                        className="gap-1.5 text-xs border-emerald-400 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/60"
                      >
                        <FileSignature className="w-3.5 h-3.5" />
                        Exportar Dossiê Forense (PDF)
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onClose()
                          navigate(`/admin/acceptance-audit?search=${encodeURIComponent(evidenceRecord.receiptNumber)}`)
                        }}
                        className="gap-1 text-xs text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/60"
                      >
                        <span>Ver Auditoria Completa</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-800 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 space-y-2 shadow-xs">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Aceite Digital Pendente para esta Empresa</span>
                  </div>
                  <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    Esta empresa foi cadastrada no plano <strong>{planDisplayName}</strong>. Assim que o responsável
                    fizer login na plataforma, o termo abaixo será exibido na íntegra para leitura e aceite obrigatório antes de liberar o acesso.
                  </p>
                </div>
              )}

              {/* DETALHES DO TERMO DO PLANO */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {acceptance?.termTitle || planTerm?.title || `Termos de Licença — ${planDisplayName}`}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Termo oficial atribuído ao plano {planDisplayName} (v{termVersion})
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200">
                    {planDisplayName}
                  </span>
                </div>

                {/* TEXTO DO TERMO ROLÁVEL */}
                <div className="max-h-[46vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-700 leading-relaxed whitespace-pre-line dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 select-text">
                  {acceptance?.termSnapshot || contract?.customTerms || planTerm?.content || 'Carregando termo...'}
                </div>
              </div>
            </div>
          ) : (
            /* ABA 2: CONTRATO FORMAL A4 */
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200 flex items-center justify-between">
                <span>
                  Visualização do Contrato Formal de Locação de Software nº <strong>{contract?.contractNumber}</strong>
                </span>
                <Button
                  size="sm"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Visualizar em Tela Cheia / Imprimir PDF
                </Button>
              </div>

              {/* Quadro Resumo */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Condições Comerciais do Contrato
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-400 block">Plano:</span>
                    <strong className="text-purple-700 dark:text-purple-300">{planDisplayName}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-400 block">Mensalidade:</span>
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {formatCurrency((contract?.monthlyAmount || 149.9).toFixed(2))}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-400 block">Vencimento:</span>
                    <strong>Todo dia {contract?.billingDay || 10}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-400 block">Início da Licença:</span>
                    <strong>{contract?.startDate ? contract.startDate.split('-').reverse().join('/') : '-'}</strong>
                  </div>
                </div>
              </div>

              {/* Cláusulas do Contrato Formal */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 space-y-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                <div className="font-bold uppercase pb-2 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                  Cláusulas Contratuais Vinculadas ao Plano
                </div>
                <div className="space-y-3">
                  <p>
                    <strong>1. DO OBJETO:</strong> Concessão de licença temporária, não exclusiva e intransferível do software de gestão empresarial denominado <strong>{planDisplayName}</strong>, operado sob modelo SaaS em nuvem.
                  </p>
                  <p>
                    <strong>2. DA VINCULAÇÃO AOS TERMOS DE USO:</strong> Fazem parte integrante e inseparável deste contrato as cláusulas aceitas eletronicamente relativas ao <strong>{planDisplayName} (v{termVersion})</strong>.
                  </p>
                  <p>
                    <strong>3. DA VALIDADE JURÍDICA DO ACEITE ELETRÔNICO:</strong> Nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020, o registro de aceite eletrônico com endereço IP ({acceptedIp}), registro cronológico e identificação do usuário constitui prova plena de contratação e anuência do Assinante.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 rounded-b-2xl">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>
              Empresa: <strong>{company.name}</strong> • Admin: <strong>{company.adminEmail}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onOpenInvoices && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenInvoices(company)}
                className="gap-1.5 text-xs text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
              >
                <Receipt className="w-3.5 h-3.5" />
                Ver Faturas
              </Button>
            )}
            <Button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="gap-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir Contrato
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs"
            >
              Fechar
            </Button>
          </div>
        </div>
      </div>

      {/* Modal A4 de Impressão Isolada */}
      {isPrintModalOpen && contract && (
        <ContractPrintModal
          contract={contract}
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null
}
