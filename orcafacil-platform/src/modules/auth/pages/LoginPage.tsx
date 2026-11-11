import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Calculator,
  ChartNoAxesCombined,
  Check,
  CircleDollarSign,
  Clock,
  FileText,
  MessageCircle,
  ReceiptText,
  ShoppingCart,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { cashBillsService } from '@modules/cash/services/cash-bills.service'
import { organizationService } from '@modules/organizations/services/organization.service'
import { useLocation } from 'react-router-dom'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { BrandLogo } from '@shared/components/BrandLogo'
import { WhatsAppIcon } from '@shared/components/WhatsAppIcon'
import { isSystemOwner } from '@shared/utils/system-owner'
import { systemMaintenanceService } from '@shared/services/system-maintenance.service'
import { SystemMaintenanceScreen } from '@shared/components/SystemMaintenanceScreen'

export function LoginPage() {
  const { signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [isOrgDeactivated, setIsOrgDeactivated] = useState(Boolean((location.state as any)?.deactivated))
  const [deactivatedOrgName, setDeactivatedOrgName] = useState<string>((location.state as any)?.orgName || '')
  const [isTrialExpired, setIsTrialExpired] = useState(Boolean((location.state as any)?.trialExpired))
  const [expiredOrgName, setExpiredOrgName] = useState<string>((location.state as any)?.orgName || '')

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

      // Se não for o Proprietário do Sistema, valida se a empresa está desativada ou com teste expirado
      if (!isOwner) {
        const orgsRes = await organizationService.getUserOrganizations()
        if (orgsRes.success && orgsRes.data.length > 0) {
          const allInactive = orgsRes.data.every((o) => o.isActive === false)
          if (allInactive) {
            const firstOrg = orgsRes.data[0]
            await signOut()
            setIsOrgDeactivated(true)
            setDeactivatedOrgName(firstOrg.name)
            setIsLoading(false)
            return
          }

          const allExpired = orgsRes.data.every((o) => {
            if (!o.trialEndsAt) return false
            return new Date(o.trialEndsAt).getTime() < Date.now()
          })

          if (allExpired) {
            const firstOrg = orgsRes.data[0]
            await signOut()
            setIsTrialExpired(true)
            setExpiredOrgName(firstOrg.name)
            setIsLoading(false)
            return
          }
        }
      }
      navigate('/')
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
    <main className="min-h-screen bg-[#F8FAFC] lg:flex">
      <section className="relative hidden min-h-screen w-1/2 overflow-hidden bg-[#0F172A] px-8 py-8 text-white lg:flex lg:flex-col lg:justify-between lg:px-12 xl:px-20">
        <div className="absolute -right-36 -top-32 h-[28rem] w-[28rem] rounded-full border border-white/10" />
        <div className="absolute -right-20 -top-16 h-[22rem] w-[22rem] rounded-full border border-white/10" />

        <div className="relative">
          <BrandLogo dark />

          <div className="mt-16 max-w-lg">
            <p className="mb-5 text-sm font-semibold uppercase text-blue-300">Gestão empresarial</p>
            <h1 className="text-4xl font-semibold leading-tight">
              Gestão inteligente para o seu negócio.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
              Tenha mais clareza sobre a operação e tome decisões com confiança, em um só lugar.
            </p>
          </div>

          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-4">
            <li className="flex items-center gap-3 text-sm font-medium text-slate-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300">
                <CircleDollarSign aria-hidden="true" className="h-5 w-5" />
              </span>
              Controle Financeiro
            </li>
            <li className="flex items-center gap-3 text-sm font-medium text-slate-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300">
                <FileText aria-hidden="true" className="h-5 w-5" />
              </span>
              Ordem de Serviço e Orçamentos
            </li>
            <li className="flex items-center gap-3 text-sm font-medium text-slate-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300">
                <ShoppingCart aria-hidden="true" className="h-5 w-5" />
              </span>
              Vendas Rápidas e Vendas PDV
            </li>
            <li className="flex items-center gap-3 text-sm font-medium text-slate-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300">
                <ChartNoAxesCombined aria-hidden="true" className="h-5 w-5" />
              </span>
              Relatório Financeiros e Gerencial
            </li>
            <li className="flex items-center gap-3 text-sm font-medium text-slate-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300">
                <Calculator aria-hidden="true" className="h-5 w-5" />
              </span>
              Controle Geral do Caixa
            </li>
            <li className="flex items-center gap-3 text-sm font-medium text-slate-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300">
                <Users aria-hidden="true" className="h-5 w-5" />
              </span>
              Controle de acesso de funcionários
            </li>
            <li className="col-span-2 flex items-center gap-3 text-sm font-medium text-slate-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300">
                <ReceiptText aria-hidden="true" className="h-5 w-5" />
              </span>
              Emissão de nota fiscal NFC e NFC-e
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
            <span className="inline-flex items-center gap-2">
              <Check aria-hidden="true" className="h-5 w-5 text-emerald-500" />
              Sem taxa de implantação
            </span>
            <span className="inline-flex items-center gap-2">
              <Check aria-hidden="true" className="h-5 w-5 text-emerald-500" />
              Sem taxa de cancelamento
            </span>
          </div>
          <div className="mt-6 max-w-md rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4">
            <p className="text-sm font-semibold text-white">1 mês grátis para sua empresa</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              Clientes podem solicitar 1 mês grátis de utilização.
            </p>
            <a
              href="https://wa.me/5531986848490?text=Ol%C3%A1%21%20Gostaria%20de%20solicitar%201%20m%C3%AAs%20gr%C3%A1tis%20de%20utiliza%C3%A7%C3%A3o."
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              Fale pelo WhatsApp
            </a>
          </div>
        </div>

        <p className="relative text-xs text-slate-400">ControleSoft</p>
      </section>

      <section className="flex min-h-screen w-full flex-col items-center bg-[#F8FAFC] px-5 py-8 sm:px-8 lg:w-1/2 lg:px-12">
        <div className="flex w-full flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[440px]">
            <header className="mb-8 text-center flex flex-col items-center">
              <img
                src="/controlesoft-logo.png"
                alt="ControleSoft"
                className="h-16 sm:h-20 w-auto object-contain mx-auto mb-5 drop-shadow-xs"
              />
              <h2 className="text-3xl font-semibold text-slate-900">Acesse sua conta</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                ControleSoft — Potencialize a administração da sua empresa
              </p>
            </header>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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

              {isOrgDeactivated && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-rose-300 bg-rose-50 p-4 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-rose-100 p-2 text-rose-600 shrink-0 mt-0.5">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-rose-900">
                        Acesso da Empresa Desativado
                      </h3>
                      <p className="mt-1 text-xs text-rose-800 leading-relaxed">
                        O acesso {deactivatedOrgName ? `da empresa "${deactivatedOrgName}"` : 'da sua empresa'} está temporariamente desativado. Entre em contato com a equipe de Suporte do ControleSoft para regularizar ou reativar seu acesso.
                      </p>
                      <div className="mt-3">
                        <a
                          href="https://wa.me/5531986848490?text=Ol%C3%A1%21%20O%20acesso%20da%20minha%20empresa%20est%C3%A1%20desativado.%20Gostaria%20de%20solicitar%20suporte."
                          target="_blank"
                          rel="noreferrer"
                          title="Suporte no WhatsApp"
                          aria-label="Suporte no WhatsApp"
                          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 p-2.5 text-white hover:bg-emerald-700 transition-colors shadow-xs hover:scale-105 active:scale-95"
                        >
                          <WhatsAppIcon className="h-5 w-5" />
                        </a>
                      </div>
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
                        Tempo de teste expirado
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-amber-900 leading-relaxed">
                        Tempo de teste expirado, entre em contato com a ControleSoft
                      </p>
                      <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                        O período de teste {expiredOrgName ? `da empresa "${expiredOrgName}"` : 'da sua empresa'} encerrou. Entre em contato com nossa equipe para regularizar e continuar utilizando todos os recursos.
                      </p>
                      <div className="mt-3">
                        <a
                          href="https://wa.me/5531986848490?text=Ol%C3%A1%21%20O%20tempo%20de%20teste%20da%20minha%20empresa%20expirou.%20Gostaria%20de%20renovar%20o%20acesso%20com%20a%20JB%20Software."
                          target="_blank"
                          rel="noreferrer"
                          title="Falar com a ControleSoft no WhatsApp"
                          aria-label="Falar com a ControleSoft no WhatsApp"
                          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 p-2.5 text-white hover:bg-emerald-700 transition-colors shadow-xs hover:scale-105 active:scale-95"
                        >
                          <WhatsAppIcon className="h-5 w-5" />
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

            <p className="mt-6 text-center text-xs leading-5 text-slate-500">
              Acesso seguro à sua plataforma de gestão.
            </p>
          </div>
        </div>

        <footer className="w-full max-w-[600px] pt-6 text-center text-xs leading-5 text-slate-500">
          <span>© 2026 ControleSoft. Todos os direitos reservados.</span>
          <span className="mx-2 hidden sm:inline">|</span>
          <span className="block sm:inline">Termos de Uso</span>
          <span className="mx-2 hidden sm:inline">|</span>
          <span className="block sm:inline">Privacidade</span>
        </footer>
      </section>
    </main>
  )
}
