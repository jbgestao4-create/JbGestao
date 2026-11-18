import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  CheckCircle2,
  Clock,
  Lock,
  QrCode,
  ShieldAlert,
  X,
  Zap,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { cashBillsService } from '@modules/cash/services/cash-bills.service'
import { organizationService } from '@modules/organizations/services/organization.service'
import type { Organization } from '@shared/types/common'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { WhatsAppIcon } from '@shared/components/WhatsAppIcon'
import { isSystemOwner } from '@shared/utils/system-owner'
import { systemMaintenanceService } from '@shared/services/system-maintenance.service'
import { SystemMaintenanceScreen } from '@shared/components/SystemMaintenanceScreen'
import { userSessionService } from '@shared/services/user-session.service'
import { calculateCompanyLicenseStatus } from '@modules/companies/utils/license.utils'
import { PixPaymentCheckoutModal } from '@modules/companies/components/PixPaymentCheckoutModal'

export function LoginPage() {
  const { signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [isOrgDeactivated, setIsOrgDeactivated] = useState(Boolean((location.state as any)?.deactivated))
  const [deactivatedOrgName, setDeactivatedOrgName] = useState<string>((location.state as any)?.orgName || '')
  const [isTrialExpired, setIsTrialExpired] = useState(Boolean((location.state as any)?.trialExpired))
  const [expiredOrgName, setExpiredOrgName] = useState<string>((location.state as any)?.orgName || '')
  const [isInactiveLoggedOut] = useState(Boolean((location.state as any)?.inactivity))

  // Estados de bloqueio por fatura/licença vencida e checkout PIX (Item 2)
  const [isOverdueBlocked, setIsOverdueBlocked] = useState(false)
  const [blockedOrg, setBlockedOrg] = useState<Organization | null>(null)
  const [isPixCheckoutOpen, setIsPixCheckoutOpen] = useState(false)
  const [paymentSuccessNotice, setPaymentSuccessNotice] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('')
  const [isFullMaintenanceBlocked, setIsFullMaintenanceBlocked] = useState(false)

  useEffect(() => {
    // Sempre que acessar a tela de login do zero, limpa qualquer dispensa anterior de alertas de boletos
    cashBillsService.clearAllAlertDismissals()

    // Garante que a tela de login seja sempre exibida em modo claro
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-theme')

    void systemMaintenanceService.getStatus().then((res) => {
      if (res.success && res.data?.enabled) {
        setIsMaintenanceActive(true)
        setMaintenanceMessage(res.data.message)
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    setIsLoading(true)

    // 0. Validação de Acesso Concorrente: impede mesmo login em múltiplos locais (exceto proprietário)
    const sessionCheck = await userSessionService.checkConcurrentLogin(email)
    if (sessionCheck.isBlocked) {
      setError(
        sessionCheck.message ||
          'Já consta logado um usuário com esta conta. Não é permitido acesso simultâneo com o mesmo e-mail.',
      )
      setIsLoading(false)
      return
    }

    const res = await signIn({ email, password })

    if (res.success) {
      if (res.data.user.app_metadata.must_change_password === true) {
        navigate('/profile', { replace: true })
        setIsLoading(false)
        return
      }

      const isOwner = isSystemOwner({ email })

      // 0. Bloqueio estrito de Manutenção de Emergência: Apenas o Proprietário do Sistema tem acesso
      const maintRes = await systemMaintenanceService.getStatus()
      if (maintRes.success && maintRes.data?.enabled && !isOwner) {
        await signOut()
        setIsFullMaintenanceBlocked(true)
        setMaintenanceMessage(maintRes.data.message)
        setIsLoading(false)
        return
      }

      // Se não for o Proprietário do Sistema, valida se a empresa está desativada ou com fatura em atraso (Item 2)
      if (!isOwner) {
        const orgsRes = await organizationService.getUserOrganizations()
        if (orgsRes.success && orgsRes.data.length > 0) {
          const firstOrg = orgsRes.data[0]

          const allInactive = orgsRes.data.every((o) => o.isActive === false)
          if (allInactive) {
            await signOut()
            setIsOrgDeactivated(true)
            setBlockedOrg(firstOrg)
            setDeactivatedOrgName(firstOrg.name)
            setIsLoading(false)
            return
          }

          // Valida tolerância de 5 dias e bloqueio por inadimplência/fatura em atraso
          const allBlockedByOverdue = orgsRes.data.every((o) => {
            const lic = calculateCompanyLicenseStatus(o.trialEndsAt, o.isActive)
            return lic.isBlockedByOverdue
          })

          if (allBlockedByOverdue) {
            await signOut()
            setIsOverdueBlocked(true)
            setBlockedOrg(firstOrg)
            setExpiredOrgName(firstOrg.name)
            setIsLoading(false)
            return
          }

          // Checa se o período de teste expirou há mais de 5 dias
          const allTrialExpired = orgsRes.data.every((o) => {
            if (!o.trialEndsAt) return false
            const lic = calculateCompanyLicenseStatus(o.trialEndsAt, o.isActive)
            return lic.status === 'blocked_overdue'
          })

          if (allTrialExpired) {
            await signOut()
            setIsTrialExpired(true)
            setBlockedOrg(firstOrg)
            setExpiredOrgName(firstOrg.name)
            setIsLoading(false)
            return
          }
        }
      }

      // Registra sessão ativa do usuário imediatamente no banco
      await userSessionService.heartbeat(email)

      navigate('/dashboard')
    } else {
      setError(res.error)
    }
    setIsLoading(false)
  }

  if (isFullMaintenanceBlocked) {
    return (
      <SystemMaintenanceScreen
        message={maintenanceMessage}
        onRecheck={async () => {
          const res = await systemMaintenanceService.getStatus()
          if (res.success && !res.data?.enabled) {
            setIsFullMaintenanceBlocked(false)
            setIsMaintenanceActive(false)
          }
        }}
      />
    )
  }

  return (
    <main className="relative min-h-screen w-full flex flex-col justify-between items-center bg-gradient-to-br from-[#0B132B] via-[#0F172A] to-[#1E293B] text-slate-100 px-4 py-8 sm:px-6 lg:px-8 overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Botão de Fechar / Voltar para a Página Inicial (ControleSoft) */}
      <Link
        to="/"
        title="Voltar para a página inicial"
        aria-label="Voltar para a página inicial"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-slate-800/80 text-slate-300 backdrop-blur-md transition-all hover:bg-slate-700 hover:text-white hover:scale-105 active:scale-95 border border-slate-700/80 shadow-lg cursor-pointer group"
      >
        <X className="h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:rotate-90 duration-200" />
      </Link>

      {/* Elementos visuais de fundo combinando com a identidade visual da ControleSoft */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[34rem] w-[56rem] rounded-full bg-gradient-to-tr from-blue-600/25 via-sky-500/20 to-emerald-500/15 blur-3xl opacity-80" />
        <div className="absolute top-1/2 -left-32 h-80 w-80 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      </div>

      <div className="w-full flex-1 flex flex-col items-center justify-center py-6 sm:py-10">
        <div className="w-full max-w-[480px]">
          <header className="mb-7 text-center flex flex-col items-center">
            <Link
              to="/apresentacao"
              title="Voltar para a apresentação do sistema"
              className="group mb-5 inline-block transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              <img
                src="/controlesoft-logo-full.jpg"
                alt="ControleSoft"
                className="h-24 w-24 sm:h-28 sm:w-28 rounded-3xl object-cover bg-[#FAF9F6] shadow-xl shadow-black/30 ring-1 ring-white/20 mx-auto"
              />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Acesse sua conta
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              ControleSoft — Potencialize a administração da sua empresa
            </p>
          </header>

          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-9 shadow-2xl shadow-black/40 text-slate-900">
              {isMaintenanceActive && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-amber-100 p-2 text-amber-700 shrink-0 mt-0.5">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-amber-900">
                        Sistema em Manutenção de Emergência Temporária
                      </h3>
                      <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                        {maintenanceMessage ||
                          'O sistema encontra-se em manutenção temporária. Solicitamos que aguardem o retorno das operações em instantes.'}
                      </p>
                      <span className="block mt-2 text-[11px] font-semibold text-amber-700">
                        * Acesso restrito a administradores e desenvolvedores autorizados.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {isInactiveLoggedOut && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-amber-100 p-2 text-amber-700 shrink-0 mt-0.5">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-amber-950">
                        Sessão Encerrada por Inatividade
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-amber-900 leading-relaxed">
                        Por motivos de segurança, você foi desconectado após 2 minutos sem utilização ou movimentação no sistema.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {paymentSuccessNotice && (
                <div
                  role="alert"
                  className="mb-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700 shrink-0 mt-0.5">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-emerald-950">
                        Pagamento Aprovado com Sucesso!
                      </h3>
                      <p className="mt-1 text-xs text-emerald-900 leading-relaxed font-semibold">
                        {paymentSuccessNotice}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isOverdueBlocked && (
                <div
                  role="alert"
                  className="mb-5 rounded-2xl border border-rose-300 bg-rose-50 p-5 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-rose-100 p-2.5 text-rose-700 shrink-0 mt-0.5">
                      <Lock className="h-6 w-6" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-sm font-bold text-rose-950">
                        Acesso Bloqueado por Fatura / Licença em Atraso
                      </h3>
                      <p className="mt-1 text-xs text-rose-900 leading-relaxed">
                        O período de tolerância {expiredOrgName ? `da empresa "${expiredOrgName}"` : 'da sua empresa'} expirou devido a fatura de mensalidade em atraso.
                      </p>
                      <p className="mt-0.5 text-[11px] text-rose-800 leading-relaxed">
                        Para restabelecer o acesso imediatamente com <strong>+30 dias de licença</strong>, realize o pagamento via PIX abaixo:
                      </p>

                      <div className="pt-2 flex flex-wrap items-center gap-2.5">
                        <Button
                          type="button"
                          onClick={() => setIsPixCheckoutOpen(true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold shadow-md text-xs py-2 px-3.5"
                        >
                          <QrCode className="h-4 w-4" />
                          <Zap className="h-3.5 w-3.5" />
                          Pagar Licença via PIX (Liberação Imediata +30 Dias)
                        </Button>

                        <a
                          href="https://wa.me/5531986848490?text=Ol%C3%A1%21%20O%20acesso%20da%20minha%20empresa%20est%C3%A1%20bloqueado%20por%20fatura%20em%20atraso.%20Gostaria%20de%20ajuda."
                          target="_blank"
                          rel="noreferrer"
                          title="Falar com suporte no WhatsApp"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-50 transition-colors"
                        >
                          <WhatsAppIcon className="h-4 w-4" />
                          Suporte WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isOrgDeactivated && (
                <div
                  role="alert"
                  className="mb-5 rounded-2xl border border-rose-200 bg-white shadow-md overflow-hidden"
                >
                  {/* Cabeçalho Vermelho */}
                  <div className="bg-rose-600 px-4 py-3 text-white flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/20 shrink-0">
                      <ShieldAlert className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-100 block">
                        Bloqueio de Segurança Financeira
                      </span>
                      <h3 className="text-sm font-black leading-tight">
                        Bloqueio por Inadimplência
                      </h3>
                    </div>
                  </div>

                  {/* Corpo do Aviso */}
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      O acesso {deactivatedOrgName ? <>da empresa <strong className="text-gray-900">"{deactivatedOrgName}"</strong></> : 'da sua empresa'} encontra-se <strong className="text-rose-700">bloqueado por inadimplência</strong>. Para a normalização e liberação imediata do sistema, é necessário realizar o pagamento.
                    </p>

                    <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-2">
                      <Button
                        type="button"
                        onClick={() => setIsPixCheckoutOpen(true)}
                        className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold shadow-sm text-xs uppercase tracking-wide"
                      >
                        <QrCode className="h-4 w-4" />
                        Gerar QR Code para Pagamento (PIX)
                      </Button>
                      <p className="text-[11px] text-gray-500 text-center">
                        O sistema identifica o PIX automaticamente e libera o acesso na hora (+30 dias).
                      </p>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                      <a
                        href="https://wa.me/5531986848490?text=Ol%C3%A1%21%20O%20acesso%20da%20minha%20empresa%20est%C3%A1%20bloqueado%20por%20inadimpl%C3%AAncia.%20Gostaria%20de%20regularizar."
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                      >
                        <WhatsAppIcon className="h-3.5 w-3.5" />
                        Falar no WhatsApp
                      </a>
                      <a
                        href="mailto:controlesoft@outlook.com"
                        className="text-[11px] font-medium text-gray-500 hover:text-gray-700 underline"
                      >
                        controlesoft@outlook.com
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {isTrialExpired && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-amber-100 p-2 text-amber-700 shrink-0 mt-0.5">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-amber-950">
                        Período de Avaliação Gratuita (Trial) Encerrado
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-amber-900 leading-relaxed">
                        Tempo de teste expirado, renove sua licença via PIX ou contate a ControleSoft
                      </p>
                      <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                        O período de teste gratuito {expiredOrgName ? `da empresa "${expiredOrgName}"` : 'da sua empresa'} chegou ao fim. Ative seu plano instantaneamente via PIX:
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2.5">
                        <Button
                          type="button"
                          onClick={() => setIsPixCheckoutOpen(true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold shadow-md text-xs py-2 px-3.5"
                        >
                          <QrCode className="h-4 w-4" />
                          <Zap className="h-3.5 w-3.5" />
                          Ativar Licença via PIX (+30 Dias)
                        </Button>
                        <a
                          href="https://wa.me/5531986848490?text=Ol%C3%A1%21%20O%20tempo%20de%20teste%20da%20minha%20empresa%20expirou.%20Gostaria%20de%20renovar%20o%20acesso%20com%20a%20JB%20Software."
                          target="_blank"
                          rel="noreferrer"
                          title="Falar com a ControleSoft no WhatsApp"
                          aria-label="Falar com a ControleSoft no WhatsApp"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 transition-colors shadow-xs"
                        >
                          <WhatsAppIcon className="h-4 w-4" />
                          Ativar Plano no WhatsApp
                        </a>
                        <a
                          href="mailto:controlesoft@outlook.com"
                          className="text-[11px] font-semibold text-amber-900 underline hover:text-amber-700"
                        >
                          controlesoft@outlook.com
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
                <Input
                  label="E-mail"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />

                <Input
                  label="Senha"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                />

                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-[#2563EB] hover:text-blue-700"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full rounded-lg bg-[#2563EB] text-sm font-semibold hover:bg-blue-700"
                  isLoading={isLoading}
                >
                  Entrar
                </Button>
              </form>


            </div>

            <p className="mt-6 text-center text-xs leading-5 text-slate-400">
              Ao entrar, você concorda com nossos{' '}
              <Link
                to="/politica-de-privacidade?tab=terms"
                className="font-semibold text-blue-400 hover:text-blue-300 hover:underline"
              >
                Termos de Uso
              </Link>{' '}
              e com a{' '}
              <Link
                to="/politica-de-privacidade"
                className="font-semibold text-blue-400 hover:text-blue-300 hover:underline"
              >
                Política de Privacidade (LGPD)
              </Link>
              .
            </p>
          </div>
        </div>

        <footer className="w-full max-w-[600px] py-6 text-center text-xs leading-5 text-slate-400">
          <span>© 2026 ControleSoft. Todos os direitos reservados.</span>
          <span className="mx-2 hidden sm:inline">|</span>
          <Link
            to="/politica-de-privacidade?tab=terms"
            className="block sm:inline font-medium text-slate-400 hover:text-blue-400 hover:underline"
          >
            Termos de Uso
          </Link>
          <span className="mx-2 hidden sm:inline">|</span>
          <Link
            to="/politica-de-privacidade"
            className="block sm:inline font-medium text-slate-400 hover:text-blue-400 hover:underline"
          >
            Política de Privacidade e LGPD
          </Link>
        </footer>

        {/* Modal de Pagamento de Licença via PIX - Liberação Imediata (Item 2) */}
        <PixPaymentCheckoutModal
          isOpen={isPixCheckoutOpen}
          onClose={() => setIsPixCheckoutOpen(false)}
          organizationId={blockedOrg?.id}
          prefillClientName={blockedOrg?.name || expiredOrgName || deactivatedOrgName}
          customTitle="Renovação de Licença • Liberação Imediata +30 Dias"
          onPaymentSuccess={() => {
            setIsOverdueBlocked(false)
            setIsTrialExpired(false)
            setIsOrgDeactivated(false)
            setPaymentSuccessNotice(
              'Pix realizado com sucesso. Obrigado! Mais 30 dias de acesso adicionados à sua empresa. Insira suas credenciais abaixo para entrar.'
            )
          }}
        />
      </main>
  )
}
